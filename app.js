(function() {
  function Form($el){
    this.$el = $el;

    this.subject = function(val){ return this._getOrSet('.subject', val); };
    this.description = function(val){return this._getOrSet('.description', val); };
    this.group = function(val){return this._getOrSet('.group', val); };
    this.assignee = function(val){return this._getOrSet('.assignee', val); };
    this.requesterEmail = function(val){return this._getOrSet('.requester_email', val); };
    this.requesterName = function(val){return this._getOrSet('.requester_name', val); };

    this.copyRequesterChecked = function(){
      return this.$el.find('.copy_requester').is(':checked');
    };

    this.isValid = function(){
      return _.all(['.subject', '.description'], function(field) {
        return this.validateField(field);
      }, this);
    };

    this.validateField = function(field){
      var viewField = this.$el.find(field),
      valid = !_.isEmpty(viewField.val());

      if (valid){
        viewField.parents('.control-group').removeClass('error');
      } else {
        viewField.parents('.control-group').addClass('error');
      }

      return valid;
    };

    this.toggleRequester = function(){
      return this.$el.find('.requester_fields').toggle();
    };

    this.fillGroupWithCollection = function(collection){
      return this.$el.find('.group').html(this._htmlOptionsFor(collection));
    };

    this.fillAssigneeWithCollection = function(collection){
      return this.$el.find('.assignee').html(this._htmlOptionsFor(collection));
    };

    this.showAssignee = function(){
      return this.$el.find('.assignee-group').show();
    };

    this.hideAssignee = function(){
      return this.$el.find('.assignee-group').hide();
    };

    this._htmlOptionsFor =  function(collection){
      var options = '<option>-</option>';

      _.each(collection, function(item){
        options += '<option value="'+item.id+'">'+item.name+'</option>';
      });

      return options;
    };

    this._getOrSet = function(selector, val){
      if (_.isUndefined(val))
        return this.$el.find(selector).val();
      return this.$el.find(selector).val(val);
    };
  }

  function Spinner($el){
    this.$el = $el;

    this.spin = function(){
      this.$el.show();
    };

    this.unSpin = function(){
      this.$el.hide();
    };
  }

  return {
    appVersion: '1.0',
    childRegex: /child_of:(\d*)/,
    parentRegex: /(?:father_of|parent_of):(\d*)/, //father_of is here to ensure compatibility with older versions
    descriptionDelimiter: '\n--- Original Description --- \n',

    events: {
      'app.activated'                   : 'onActivated',
      'ticket.status.changed'           : 'loadIfDataReady',
      'createChildTicket.done'          : 'createChildTicketDone',
      'createChildTicket.fail'          : 'createChildTicketFail',
      'fetchTicket.done'                : 'fetchTicketDone',
      'fetchGroupsAndUsers.done'        : 'fetchGroupsAndUsersDone',
      'fetchGroupsAndUsers.fail'        : 'fetchGroupsAndUsersFail',
      'click .new-linked-ticket'        : 'displayForm',
      'click .create-linked-ticket'     : 'create',
      'click .copy_description'         : 'copyDescription',
      'click .copy_requester'           : function(){this.form.toggleRequester();},
      'change .group'                   : 'groupChanged'
    },

    requests: {
      createChildTicket: function(ticket){
        return {
          url: '/api/v2/tickets.json',
          dataType: 'json',
          data: ticket,
          type: 'POST'
        };
      },
      updateCurrentTicket: function(data){
        return {
          url: '/api/v2/tickets/'+ this.ticket().id() +'.json',
          dataType: 'json',
          data: data,
          type: 'PUT'
        };
      },
      fetchTicket: function(id){
        return {
          url: '/api/v2/tickets/' + id + '.json?include=groups,users',
          dataType: 'json',
          type: 'GET'
        };
      },
      autocompleteRequester: function(email){
        return {
          url: '/api/v2/users/autocomplete.json?email=' + email,
          type: 'POST'
        };
      },
      fetchGroupsAndUsers: function(){
        return {
          url: '/api/v2/group_memberships.json?include=users,groups',
          type: 'GET'
        };
      }
    },

    onActivated: function(data) {
      this.doneLoading = false;

      this.ticketFields("custom_field_" + this.ancestryFieldId()).hide();

      this.loadIfDataReady();
    },

    loadIfDataReady: function(){
      if(!this.doneLoading &&
         this.ticket() &&
         this.ticket().id()){

        if (this.hasChild() || this.hasParent())
          return this.ajax('fetchTicket', this.childID() || this.parentID());

        this.ajax('fetchGroupsAndUsers');

        this.switchTo('home');

        this.doneLoading = true;
      }
    },

    fetchTicketDone: function(data){
      var assignee = _.find(data.users, function(user){
        return user.id == data.ticket.assignee_id;
      });

      var custom_field = _.find(data.ticket.custom_fields, function(field){
        return field.id == this.ancestryFieldId();
      }, this);

      var is_child = this.childRegex.test(custom_field.value);

      var group = _.find(data.groups, function(item){
        return item.id == data.ticket.group_id;
      });

      if (assignee)
        assignee = assignee.name;

      this.switchTo('has_relation', { ticket: data.ticket,
                                      is_child: is_child,
                                      assignee: assignee,
                                      group: group
                                    });
    },

    displayForm: function(event){
      event.preventDefault();

      this.switchTo('form');

      this.form = new Form(this.$('form.linked_ticket_form'));
      this.spinner = new Spinner(this.$('.spinner'));

      this.form.fillGroupWithCollection(this.groups);

      this.bindAutocompleteOnRequesterEmail();
    },

    create: function(event){
      event.preventDefault();

      if (this.form.isValid()){
        this.spinner.spin();
        this.ajax('createChildTicket', this.childTicketAsJson());
      }
    },

    createChildTicketDone: function(data){
      var field = {};
      var value = "parent_of:" + data.ticket.id;

      this.ticket().customField("custom_field_" + this.ancestryFieldId(),
                                value
                               );

      field[this.ancestryFieldId()] = value;

      this.ajax('updateCurrentTicket', { "ticket": { "fields": field }});

      this.ajax('fetchTicket', data.ticket.id);

      this.spinner.unSpin();
    },

    createChildTicketFail: function(data){
      services.notify(this.I18n.t('ticket_creation_failed'), 'error');

      this.spinner.unSpin();
    },

    copyDescription: function(){
      var description = this.form.description()
        .split(this.descriptionDelimiter);

      var ret = description[0];

      if (description.length === 1)
        ret += this.descriptionDelimiter + this.ticket().description();

      this.form.description(ret);
    },

    bindAutocompleteOnRequesterEmail: function(){
      var self = this;

      // bypass this.form to bind the autocomplete.
      this.$('.requester_email').autocomplete({
        minLength: 3,
        source: function(request, response) {
          self.ajax('autocompleteRequester', request.term).done(function(data){
            response(_.map(data.users, function(user){
              return {"label": user.email, "value": user.email};
            }));
          });
        }
      });
    },

    fetchGroupsAndUsersDone: function(data){
      this.users = data.users;
      this.groups = data.groups;
      this.group_memberships = data.group_memberships;
    },

    fetchGroupsAndUsersFail: function(){
      services.notify(this.I18n.t('fetch_groups_and_users_failed'), 'error');
    },

    groupChanged: function(){
      var group_id = Number(this.form.group());
      var users = [];

      if (_.isFinite(group_id)){
        var user_ids = this.group_memberships
          .filter(function(membership) {
            return membership.group_id == group_id;
          })
          .map(function(membership){
            return membership.user_id;
          });

        users = this.users.filter(function(user){
          return user_ids.contains(user.id);
        });
        this.form.showAssignee();
      } else {
        this.form.hideAssignee();
      }

      this.form.fillAssigneeWithCollection(users);
    },


    childTicketAsJson: function(){
      var params = {
        "subject": this.form.subject(),
        "description": this.form.description(),
        "fields": {}
      };
      var group_id = Number(this.form.group());
      var assignee_id = Number(this.form.assignee());

      if (!_.isEmpty(this.settings.child_tag))
        params.tags = [ this.settings.child_tag ];

      if (this.form.copyRequesterChecked()){
        params.requester_id = this.ticket().requester().id();
      } else {
        params.requester = {
          "email": this.form.requesterEmail(),
          "name": this.form.requesterName()
        };
      }

      if (_.isFinite(group_id))
        params.group_id = group_id;

      if (_.isFinite(assignee_id))
        params.assignee_id = assignee_id;

      params.fields[this.ancestryFieldId()] = 'child_of:' + this.ticket().id();

      return { "ticket": params };
    },
    ancestryValue: function(){
      return this.ticket().customField("custom_field_" + this.ancestryFieldId());
    },
    ancestryFieldId: function(){
      return this.setting('ancestry_field');
    },
    hasChild: function(){
      return this.parentRegex.test(this.ancestryValue());
    },
    hasParent: function(){
      return this.childRegex.test(this.ancestryValue());
    },
    childID: function(){
      if (!this.hasChild())
        return;

      return this.parentRegex.exec(this.ancestryValue())[1];
    },
    parentID: function(){
      if (!this.hasParent())
        return;

      return this.childRegex.exec(this.ancestryValue())[1];
    }
  };
}());
